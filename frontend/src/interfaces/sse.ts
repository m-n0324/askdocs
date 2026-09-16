/** One parsed Server-Sent Events frame. */
export interface ISseFrame {
  event: string;
  data: string;
}
