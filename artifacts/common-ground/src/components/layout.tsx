import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleSignOut = () => {
    signOut({ redirectUrl: basePath || "/" });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12H5V22H19V12H22L12 2Z" fill="currentColor" className="text-primary"/>
              <circle cx="12" cy="14" r="3" fill="currentColor" className="text-primary-foreground" />
            </svg>
            <span className="font-bold sm:inline-block">Common Ground</span>
          </Link>

          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <Show when="signed-in">
                <Link href="/matches">
                  <Button variant="ghost" className={location === "/matches" ? "bg-accent" : ""}>Matches</Button>
                </Link>
                <Link href="/candidates">
                  <Button variant="ghost" className={location === "/candidates" ? "bg-accent" : ""}>Candidates</Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" className={location === "/profile" ? "bg-accent" : ""}>Profile</Button>
                </Link>
                <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
              </Show>
              <Show when="signed-out">
                <Link href="/sign-in">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                  <Button>Sign Up</Button>
                </Link>
              </Show>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>
      
      <footer className="border-t py-6 md:py-0">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 md:px-6">
          <p className="text-sm text-muted-foreground leading-loose">
            A non-partisan civic tool. Vote your values.
          </p>
        </div>
      </footer>
    </div>
  );
}
