import React, { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import type { z } from "zod";

import { useAuth } from "../helpers/useAuth";
import { schema as loginSchema } from "../endpoints/auth/login_POST.schema";

import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useForm,
} from "../components/Form";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { TemplateGallery } from "../components/TemplateGallery";

import styles from "./login.module.css";

export default function LoginPage() {
  const { login, isAuthenticated, isLoginLoading } = useAuth();
  const navigate = useNavigate();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    schema: loginSchema,
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setGeneralError(null);
    try {
      await login(values);
      navigate("/studio");
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : "Authentication failed. Please try again."
      );
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Login — Fold Studio Lab</title>
      </Helmet>

      <div className={styles.header}>
        <img
          src="/_cdn/static/project-icon.png"
          alt="Fold Studio Lab Logo"
          className={styles.logo}
        />
        <span className={styles.brandText}>Fold Studio Lab Alpha</span>
      </div>

      <div className={styles.loginSection}>
        <div className={styles.formWrapper}>
          {isAuthenticated ? (
            <div className={styles.authActions}>
              <Button asChild variant="primary" className={styles.actionBtn}>
                <Link to="/studio">Open Studio</Link>
              </Button>
              <Button asChild variant="outline" className={styles.actionBtn}>
                <Link to="/unfolder">Try Unfolder</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.alphaSection}>
                <Button asChild variant="primary" className={styles.tryAlphaBtn} size="lg">
                  <Link to="/studio">Try Alpha Version for Free</Link>
                </Button>
                <p className={styles.tryAlphaSubtext}>
                  Free access to 2D & 3D tools — no account required
                </p>
              </div>

              <div className={styles.signInSection}>
                <div className={styles.divider}>
                  <div className={styles.line} />
                  <span className={styles.orText}>or sign in</span>
                  <div className={styles.line} />
                </div>

                <div className={styles.loginFormSmall}>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className={styles.form}
                      noValidate
                    >
                      <FormItem name="email">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={form.values.email}
                            onChange={(e) =>
                              form.setValues((prev) => ({ ...prev, email: e.target.value }))
                            }
                            disabled={isLoginLoading}
                            autoComplete="email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <FormItem name="password">
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            value={form.values.password}
                            onChange={(e) =>
                              form.setValues((prev) => ({
                                ...prev,
                                password: e.target.value,
                              }))
                            }
                            disabled={isLoginLoading}
                            autoComplete="current-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <Button
                        type="submit"
                        variant="primary"
                        className={styles.submitBtn}
                        disabled={isLoginLoading}
                      >
                        {isLoginLoading ? "Signing in..." : "Sign In"}
                      </Button>

                      {generalError && (
                        <div className={styles.generalError}>{generalError}</div>
                      )}
                    </form>
                  </Form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <TemplateGallery />
    </div>
  );
}