"use client";

import * as React from "react";

export type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme, x?: number, y?: number) => void;
};

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    // Check if we're in the browser
    if (typeof window !== "undefined") {
      // Check localStorage first
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored) return stored;
      
      // Then check system preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  });

  const setTheme = React.useCallback((newTheme: Theme, x?: number, y?: number) => {
    // Skip transition if View Transitions API is not supported
    if (!document.startViewTransition) {
      setThemeState(newTheme);
      return;
    }

    const transition = document.startViewTransition(() => {
      setThemeState(newTheme);
    });

    // If we have click coordinates, add the mask
    if (x != null && y != null) {
      const endRadius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
      );

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 300,
            easing: "ease-in",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    }
  }, []);

  // Update the class on the html element whenever theme changes
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
} 