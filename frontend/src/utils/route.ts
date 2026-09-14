/** Next's router.query values can be string | string[] | undefined; we want one string. */
export function getRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
