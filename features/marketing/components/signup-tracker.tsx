"use client";

import { useEffect } from "react";
import { trackGaOnce } from "../analytics";

/** signup_complete (GA4): la cuenta ya existe y llegó al asistente; una vez por usuario. */
export function SignupTracker({ userId }: { userId: string }) {
  useEffect(() => trackGaOnce("signup_complete", userId), [userId]);
  return null;
}
