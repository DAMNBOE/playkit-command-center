import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), signIn: vi.fn(), navigate: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signUp: mocks.signUp, signInWithPassword: mocks.signIn } } }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/components/app/bits", () => ({ Logo: () => null }));
import { Route } from "@/routes/auth";

function signup() {
  const Page = Route.options.component as ComponentType;
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "No account? Create one" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "signup@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("Email and password signup", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("signs up with email and password and navigates immediately when a session is returned", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null });
    signup();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/settings" }));
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "signup@example.com", password: "test-password-123" });
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it("never reports successful sign-in when signup returns no session", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    signup();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});