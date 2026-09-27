export const getTenantIdFromState = (state: any): string | null => {
  const userState = state?.user;
  const user = userState?.user;
  const tenantInfo = userState?.tenantInfo;

  return (
    user?.schoolId ||
    user?.school?.id ||
    userState?.schoolId ||
    tenantInfo?.schoolId ||
    tenantInfo?.id ||
    null
  );
};

export const applyTenantIdHeaders = (
  headers: any,
  tenantId: string | null | undefined,
) => {
  if (!tenantId || !headers) return;

  if (typeof headers.set === "function") {
    headers.set("X-Tenant-ID", tenantId);
    headers.set("x-tenant-id", tenantId);
    headers.set("X-School-ID", tenantId);
    headers.set("x-school-id", tenantId);
    return;
  }

  headers["X-Tenant-ID"] = tenantId;
  headers["x-tenant-id"] = tenantId;
  headers["X-School-ID"] = tenantId;
  headers["x-school-id"] = tenantId;
};
