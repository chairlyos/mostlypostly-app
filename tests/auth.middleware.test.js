import { describe, it, expect, vi } from "vitest";
import { requireAuth, requireRole } from "../src/middleware/auth.js";

function makeReq(overrides = {}) {
  return {
    session: { manager_id: "mgr-1" },
    manager: { role: "manager" },
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.redirectUrl = null;
  res.statusCode = null;
  res.body = null;
  res.redirect = (url) => { res.redirectUrl = url; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.send = (body) => { res.body = body; };
  return res;
}

describe("requireAuth", () => {
  it("calls next() when session + manager present", () => {
    const next = vi.fn();
    requireAuth(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("redirects to /manager/login when no session manager_id", () => {
    const res = makeRes();
    requireAuth(makeReq({ session: {} }), res, vi.fn());
    expect(res.redirectUrl).toBe("/manager/login");
  });

  it("redirects to /manager/login when no req.manager", () => {
    const res = makeRes();
    requireAuth(makeReq({ manager: undefined }), res, vi.fn());
    expect(res.redirectUrl).toBe("/manager/login");
  });
});

describe("requireRole", () => {
  it("calls next() when role matches", () => {
    const next = vi.fn();
    requireRole("owner", "manager")(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when role not in list", () => {
    const res = makeRes();
    requireRole("owner", "manager")(makeReq({ manager: { role: "coordinator" } }), res, vi.fn());
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when manager is undefined", () => {
    const res = makeRes();
    requireRole("owner")(makeReq({ manager: undefined }), res, vi.fn());
    expect(res.statusCode).toBe(403);
  });

  it("allows owner through owner-only gate", () => {
    const next = vi.fn();
    const res = makeRes();
    requireRole("owner")(makeReq({ manager: { role: "owner" } }), res, next);
    expect(next).toHaveBeenCalled();
  });
});
