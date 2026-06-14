import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState, useEffect } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleSignOut = () => {
    signOut({ redirectUrl: basePath || "/" });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center space-x-2 shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12H5V22H19V12H22L12 2Z" fill="currentColor" className="text-primary"/>
              <circle cx="12" cy="14" r="3" fill="currentColor" className="text-primary-foreground" />
            </svg>
            <span className="font-bold">Voter Compass</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <Show when="signed-in">
                <Link href="/matches">
                  <Button variant="ghost" className={location === "/matches" ? "bg-accent" : ""}>Matches</Button>
                </Link>
                <Link href="/candidates">
                  <Button variant="ghost" className={location === "/candidates" ? "bg-accent" : ""}>Candidates</Button>
                </Link>
                <Link href="/ballot">
                  <Button variant="ghost" className={location === "/ballot" ? "bg-accent" : ""}>Ballot</Button>
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

          {/* Mobile Nav */}
          <div className="flex items-center md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[340px]">
                <nav className="flex flex-col space-y-4 mt-6">
                  <Show when="signed-in">
                    <Link href="/matches">
                      <Button variant="ghost" className={`w-full justify-start text-lg ${location === "/matches" ? "bg-accent" : ""}`}>Matches</Button>
                    </Link>
                    <Link href="/candidates">
                      <Button variant="ghost" className={`w-full justify-start text-lg ${location === "/candidates" ? "bg-accent" : ""}`}>Candidates</Button>
                    </Link>
                    <Link href="/ballot">
                      <Button variant="ghost" className={`w-full justify-start text-lg ${location === "/ballot" ? "bg-accent" : ""}`}>Ballot</Button>
                    </Link>
                    <Link href="/profile">
                      <Button variant="ghost" className={`w-full justify-start text-lg ${location === "/profile" ? "bg-accent" : ""}`}>Profile</Button>
                    </Link>
                    <Button variant="outline" className="w-full justify-start text-lg mt-4" onClick={handleSignOut}>Sign Out</Button>
                  </Show>
                  <Show when="signed-out">
                    <Link href="/sign-in">
                      <Button variant="ghost" className="w-full justify-start text-lg">Sign In</Button>
                    </Link>
                    <Link href="/sign-up">
                      <Button className="w-full justify-start text-lg">Sign Up</Button>
                    </Link>
                  </Show>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>
      
      <footer className="border-t py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:flex-row px-4 md:px-6">
          <p className="text-sm text-muted-foreground text-center">
            A non-partisan civic tool. Vote your values.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link
              href="/methodology"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              How it works
            </Link>
            <Link
              href="/candidates"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Browse candidates
            </Link>
            <a
              href="https://www.congress.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Data sources
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
