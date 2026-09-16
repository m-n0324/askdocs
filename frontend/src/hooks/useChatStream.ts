import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { QUERY_KEYS } from "@/constants";
import type { ChatStreamEvent, IChatTurn, ICitation, IConversationDetail, IMessage, MessageRole } from "@/interfaces";
import { streamChat } from "@/services";
import { appendTurn, getCitedCitations, getErrorMessage } from "@/utils";

/** Same data as IChatTurn, kept in a ref so event handlers always see the latest values. */
interface IProgress {
  conversationId: string | null;
  question: string;
  answer: string;
  citations: ICitation[];
  askedAt: string;
}

interface IUseChatStreamOptions {
  workspaceId: string;
  conversationId: string | null;
  onConversationCreated: (conversationId: string) => void;
}

const IDLE_TURN: IChatTurn = { status: "idle", question: "", answer: "", citations: [], error: null };

const localMessage = (role: MessageRole, content: string, createdAt: string, citations: ICitation[] = []): IMessage => ({
  id: `local-${role}-${createdAt}`,
  role,
  content,
  citations,
  createdAt,
});

export function useChatStream({ workspaceId, conversationId, onConversationCreated }: IUseChatStreamOptions) {
  const queryClient = useQueryClient();
  const [turn, setTurn] = useState<IChatTurn>(IDLE_TURN);
  const controllerRef = useRef<AbortController | null>(null);
  const progressRef = useRef<IProgress | null>(null);

  // Leaving the page (or switching conversation) cancels the request.
  useEffect(() => {
    const controllers = controllerRef;
    return () => controllers.current?.abort();
  }, []);

  // `exact`: the list key is a prefix of every detail key, and we must not refetch details here.
  const invalidateConversationList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations.list(workspaceId), exact: true });
  }, [queryClient, workspaceId]);

  /** Shows the finished question + answer in the conversation right away (before the refetch). */
  const commitTurn = useCallback(
    (progress: IProgress, assistantMessage: IMessage) => {
      const id = progress.conversationId;
      if (!id) return;
      const userMessage = localMessage("user", progress.question, progress.askedAt);
      queryClient.setQueryData<IConversationDetail>(QUERY_KEYS.conversations.detail(workspaceId, id), (previous) =>
        appendTurn(previous, { conversationId: id, userMessage, assistantMessage }),
      );
      invalidateConversationList();
    },
    [invalidateConversationList, queryClient, workspaceId],
  );

  const send = useCallback(
    async (question: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      progressRef.current = {
        conversationId,
        question,
        answer: "",
        citations: [],
        askedAt: new Date().toISOString(),
      };
      const updateProgress = (patch: Partial<IProgress>) => {
        if (progressRef.current) progressRef.current = { ...progressRef.current, ...patch };
      };
      let isFinished = false;
      setTurn({ ...IDLE_TURN, status: "streaming", question });

      const onEvent = (event: ChatStreamEvent) => {
        const progress = progressRef.current;
        if (!progress) return;
        if (event.type === "meta") {
          updateProgress({ conversationId: event.conversationId });
          if (!conversationId) {
            onConversationCreated(event.conversationId);
            // The new conversation exists on the server now, so show it in the sidebar.
            invalidateConversationList();
          }
        } else if (event.type === "citations") {
          updateProgress({ citations: event.citations });
          setTurn((current) => ({ ...current, citations: event.citations }));
        } else if (event.type === "token") {
          updateProgress({ answer: progress.answer + event.delta });
          setTurn((current) => ({ ...current, answer: current.answer + event.delta }));
        } else if (event.type === "done") {
          isFinished = true;
          commitTurn(progress, event.message);
          if (progress.conversationId) {
            void queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.conversations.detail(workspaceId, progress.conversationId),
            });
          }
          setTurn(IDLE_TURN);
        } else {
          isFinished = true;
          setTurn((current) => ({ ...current, status: "error", error: event.message }));
        }
      };

      try {
        await streamChat(workspaceId, { message: question, conversationId: conversationId ?? undefined }, {
          signal: controller.signal,
          onEvent,
        });
        if (!isFinished && !controller.signal.aborted) {
          setTurn((current) => ({ ...current, status: "error", error: "The answer stopped unexpectedly." }));
        }
      } catch (error) {
        if (controller.signal.aborted) return; // the user pressed Stop; stop() already updated the UI
        setTurn((current) => ({ ...current, status: "error", error: getErrorMessage(error) }));
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [commitTurn, conversationId, invalidateConversationList, onConversationCreated, queryClient, workspaceId],
  );

  const stop = useCallback(() => {
    const progress = progressRef.current;
    controllerRef.current?.abort();
    controllerRef.current = null;

    if (progress?.conversationId && progress.answer) {
      // Keep the partial answer visible as part of the conversation.
      const cited = getCitedCitations(progress.answer, progress.citations);
      commitTurn(progress, localMessage("assistant", progress.answer, new Date().toISOString(), cited));
      setTurn(IDLE_TURN);
      return;
    }
    setTurn((current) => ({ ...current, status: "error", error: "You stopped this answer before it started." }));
  }, [commitTurn]);

  return { turn, isStreaming: turn.status === "streaming", send, stop };
}
