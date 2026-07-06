  "use client";

  import { Button } from "@/components/ui/button";
  import Link from "next/link";
  import Image from "next/image";
  import logo from "../../../public/mainLogo.svg";

  import { useEffect, useRef, useState } from "react";
  import { usePathname } from "next/navigation";
  import { Menu } from "lucide-react";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";

  const Header = () => {
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollYRef = useRef(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    useEffect(() => {
      if (!mounted) return;

      lastScrollYRef.current = window.scrollY ?? document.documentElement.scrollTop;

      const handleScroll = () => {
        const currentScrollY = window.scrollY ?? document.documentElement.scrollTop;
        const last = lastScrollYRef.current;

        // Scroll progress for the bar
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        setScrolled(height > 0 ? (currentScrollY / height) * 100 : 0);

        // Hide header when scrolling down (past 100px), show when scrolling up
        if (currentScrollY > last && currentScrollY > 100) {
          setIsVisible(false);
        } else if (currentScrollY < last) {
          setIsVisible(true);
        }
        if (currentScrollY < 100) {
          setIsVisible(true);
        }

        lastScrollYRef.current = currentScrollY;
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }, [mounted]);

    const navigationLinks = [
      { label: "Product", href: "/product" },
      // { label: "For Schools", href: "#school" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ];

    return (
      <header 
        className={`fixed top-0 left-0 w-full z-50 px-0 sm:px-1 md:px-2 py-2 sm:py-2.5 md:py-3 bg-transparent transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <nav className="max-w-7xl mx-auto h-14 sm:h-14 md:h-16 pl-0 sm:pl-1 md:pl-2 pr-4 sm:pr-6 md:pr-8 bg-white rounded-full flex items-center justify-between border border-gray-200/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
          {/* Scroll Progress Bar */}
          <div className="absolute bottom-0 left-0 h-[2px] bg-transparent z-50 overflow-hidden w-full rounded-full">
            <div
              className="h-full bg-[#641bc4] transition-all duration-300 ease-out"
              style={{ width: `${scrolled}%` }}
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2 group cursor-pointer relative z-10 shrink-0">
            <Link href="/" className="relative block h-10 sm:h-12 md:h-14 lg:h-16 aspect-[930/479] bg-transparent">
              <Image
                src={logo}
                fill
                className="object-contain object-left"
                alt="paralearn logo"
                priority
                sizes="(max-width: 640px) 180px, (max-width: 768px) 220px, (max-width: 1024px) 260px, 320px"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8 md:gap-12 relative z-10">
            <div className="flex items-center gap-8">
              {navigationLinks.map((link, index) => {
                const isHashLink = link.href.startsWith('#');
                const isActive = pathname === link.href;
                
                if (isHashLink) {
                  return (
                    <a
                      key={index}
                      href={link.href}
                      className={`header-nav-link text-sm font-semibold transition-colors relative focus:outline-none px-4 py-2 rounded-lg ${
                        isActive
                          ? 'text-[#641bc4] bg-[#f0e5ff]'
                          : 'text-slate-600 hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                      }`}
                    >
                      {link.label}
                    </a>
                  );
                }

                return (
                  <Link
                    key={index}
                    href={link.href}
                    className={`header-nav-link text-sm font-semibold transition-colors relative focus:outline-none px-4 py-2 rounded-lg ${
                      isActive
                        ? 'text-[#641bc4] bg-[#f0e5ff]'
                        : 'text-slate-600 hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/auth/signin">
                <button
                  className="text-sm font-semibold text-[#0f172a] px-4 md:px-6 py-2 sm:py-2.5 hover:bg-[#f1f5f9] rounded-lg transition-colors duration-150 border border-transparent hover:border-[#e2e8f0]"
                >
                    Sign In
                </button>
              </Link>
              <Link href="/auth/signup">
                <Button className="rounded-lg px-6 md:px-8 h-10 sm:h-11 font-bold shadow-none bg-[#641bc4] hover:bg-[#7b22e8] text-white text-sm transition-all duration-150 ease-out hover:-translate-y-px active:scale-[0.97]">
                  Enroll Now
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2 sm:gap-4 relative z-10">
            <Link href="/auth/signin" className="hidden sm:block">
              <button 
                className="text-sm font-bold text-slate-900 px-4 py-2 hover:bg-slate-100 rounded-xl transition-all duration-300"
              >
                Sign In
              </button>
            </Link>
            
            {mounted ? (
              <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 mt-2 bg-white border border-gray-200 shadow-lg rounded-lg p-3">
                  {/* Mobile Navigation Links */}
                  {navigationLinks.map((link, index) => {
                    const isHashLink = link.href.startsWith('#');
                    const isActive = pathname === link.href;
                    
                    if (isHashLink) {
                      return (
                        <DropdownMenuItem key={index} asChild>
                          <a
                            href={link.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={`px-4 py-2.5 text-sm font-semibold cursor-pointer rounded-md ${
                              isActive
                                ? 'text-[#641bc4] bg-[#f0e5ff]'
                                : 'text-slate-600 hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                            }`}
                          >
                            {link.label}
                          </a>
                        </DropdownMenuItem>
                      );
                    }
                    
                    return (
                      <DropdownMenuItem key={index} asChild>
                        <Link
                          href={link.href}
                          onClick={() => setIsMenuOpen(false)}
className={`px-4 py-2.5 text-sm font-semibold cursor-pointer rounded-md ${
                              isActive
                                ? 'text-[#641bc4] bg-[#f0e5ff]'
                                : 'text-slate-600 hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                            }`}
                        >
                          {link.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  
                  <div className="border-t border-gray-200 my-2" />
                  
                  {/* Mobile Action Buttons */}
                  <DropdownMenuItem asChild className="p-0">
                    <Link 
                      href="/auth/signin"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full flex justify-center items-center text-sm font-semibold text-[#0f172a] px-4 py-2.5 hover:bg-[#f1f5f9] rounded-md transition-colors duration-150 border border-[#e2e8f0]"
                    >
                      Sign In
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="p-0">
                    <Link 
                      href="/auth/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="block w-full mt-2"
                    >
                      <Button
                        className="w-full rounded-lg h-10 font-bold shadow-none bg-[#641bc4] hover:bg-[#7b22e8] text-white text-sm"
                      >
                        Enroll Now
                      </Button>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button 
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setIsMenuOpen(true)}
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" />
              </button>
            )}
          </div>
        </nav>
      </header>
    );
  };


  export default Header;
