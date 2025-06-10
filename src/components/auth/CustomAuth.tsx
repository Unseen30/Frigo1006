import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const CustomAuth = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  if (isForgotPassword) {
    return <ForgotPasswordForm onBack={() => setIsForgotPassword(false)} />;
  }

  if (isRegistering) {
    return <RegisterForm onLogin={() => setIsRegistering(false)} />;
  }

  return (
    <LoginForm
      onForgotPassword={() => setIsForgotPassword(true)}
      onRegister={() => setIsRegistering(true)}
    />
  );
};