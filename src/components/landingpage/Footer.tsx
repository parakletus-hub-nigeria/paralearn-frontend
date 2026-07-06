"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Mail, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Facebook,
  MapPin,
  Phone,
  ArrowRight
} from "lucide-react";
import Image from "next/image";
import logo from "../../../public/mainLogo.svg";
import { toast} from "sonner";
import ComingSoonModal from "./ComingSoonModal";
import { ScrollReveal } from "./ScrollReveal";

const COMING_SOON_HREFS = [
  "/features",
  "/careers",
  "/blog",
  "/partners",
  "/documentation",
  "/help",
  "/privacy",
  "/terms",
  "/security",
  "/cookies",
];

const Footer = () => {
  const [email, setEmail] = useState("");
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState("Coming Soon");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info("Newsletter signup coming soon. We will notify you when it is available.");
    setEmail("");
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, label?: string) => {
    if (href === "/support") {
      e.preventDefault();
      window.open("https://wa.me/2348148876125", "_blank", "noopener,noreferrer");
      return;
    }
    if (COMING_SOON_HREFS.includes(href)) {
      e.preventDefault();
      setComingSoonTitle(label ?? "Coming Soon");
      setComingSoonOpen(true);
    }
  };

  const footerLinks = {
    product: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/contact" },
      // { label: "For Schools", href: "#schools" },
      // { label: "CBT System", href: "#cbt" },
    ],
    company: [
      { label: "About Us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Blog", href: "/blog" },
      { label: "Partners", href: "/partners" },
    ],
    resources: [
      { label: "Documentation", href: "/documentation" },
      { label: "Help Center", href: "/help" },
      { label: "Contact Support", href: "/support" },
      // { label: "Community", href: "#community" },
    ],
    legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Security", href: "/security" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  };

  const socialLinks = [
    { icon: Twitter, href: "https://x.com/paralearn?t=3ViWKpFjN_J4apAcsrzu0Q&s=09", label: "Twitter" },
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Instagram, href: "https://www.instagram.com/paralearn.io?igsh=Nzh5eXRpdHhtcHU5", label: "Instagram" },
    { icon: Linkedin, href: "https://www.linkedin.com/company/paralearn/", label: "LinkedIn" },
  ];

  return (
    <footer id="footer" className="relative bg-gradient-to-b from-slate-50 to-white border-t border-slate-200">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_1px_1px,rgb(100,27,196)_1px,transparent_0)] bg-[length:24px_24px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-16 md:py-20">
        {/* Newsletter Section */}
        <ScrollReveal animation="reveal" delay="0s">
        <div className="mb-16 md:mb-20">
          <div className="bg-white rounded-2xl p-8 md:p-12 border border-[#e2e8f0] shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex-1 text-center lg:text-left">
                <div className="flex items-center gap-3 mb-4 justify-center lg:justify-start">
                  <Mail className="w-6 h-6 text-[#641bc4]" />
                  <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0f172a]">
                    Stay in the <span className="text-[#641bc4]">loop</span>
                  </h3>
                </div>
                <p className="text-slate-600 text-base md:text-lg">
                  Get the latest updates, tips, and exclusive content delivered to your inbox.
                </p>
              </div>
              <form
                onSubmit={handleSubmit}
                className="flex-1 w-full lg:max-w-md flex gap-3"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 bg-white border border-[#e2e8f0] focus:border-[#641bc4] rounded-lg px-4 text-base font-medium"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 px-6 md:px-8 rounded-lg bg-[#641bc4] hover:bg-[#7b22e8] text-white font-bold shadow-none transition-all duration-150 ease-out hover:-translate-y-px active:scale-[0.97]"
                >
                  <span className="hidden sm:inline">Subscribe</span>
                  <ArrowRight className="w-5 h-5 sm:hidden" />
                </Button>
              </form>
            </div>
          </div>
        </div>
        </ScrollReveal>

        {/* Main Footer Content */}
        <ScrollReveal animation="reveal" delay="0.1s">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 md:gap-10 lg:gap-12 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 lg:col-span-1 space-y-4 md:space-y-6">
            <div className="flex items-center gap-3 md:gap-4 -mt-8 -mb-8 md:-mt-10 md:-mb-10">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 bg-transparent">
                <Image
                  src={logo}
                  alt="ParaLearn Logo"
                  className="object-contain"
                  fill
                />
              </div>
            </div>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed max-w-xs md:max-w-sm">
              Empowering African schools with modern result management solutions. From chaos to calm.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-start gap-2 md:gap-3">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-slate-600">
                  Port Harcourt, Rivers State
                </p>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Phone className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0" />
                <a href="tel:+2348148876125" className="text-xs sm:text-sm text-slate-600 hover:text-primary transition-colors">
                +234 814887 6125
                </a>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Mail className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0" />
                <a href="mailto:paralearn.io@gmail.com" className="text-xs sm:text-sm text-slate-600 hover:text-primary transition-colors break-all">
                  paralearn.io@gmail.com
                </a>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-2 md:gap-3 pt-2">
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                const isExternal = social.href.startsWith('http');
                return (
                  <a
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center hover:bg-[#641bc4] hover:text-white transition-all duration-150 hover:-translate-y-0.5 border border-[#e2e8f0] text-slate-600"
                  >
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3 md:space-y-4">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-900">
              Product
            </h4>
            <nav className="flex flex-col gap-2 md:gap-3">
              {footerLinks.product.map((link, index) => {
                const isExternal = link.href.startsWith('http');
                const isHash = link.href.startsWith('#');
                if (isExternal || isHash) {
                  return (
                    <a
                      key={index}
                      href={link.href}
                      className="text-sm text-slate-600 hover:text-primary transition-colors font-medium"
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                    >
                      {link.label}
                    </a>
                  );
                }
                return (
                  <a
                    key={index}
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href, link.label)}
                    className="text-sm text-slate-600 hover:text-primary transition-colors font-medium cursor-pointer"
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Company Links */}
          <div className="space-y-3 md:space-y-4">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-900">
              Company
            </h4>
            <nav className="flex flex-col gap-2 md:gap-3">
              {footerLinks.company.map((link, index) => {
                const isExternal = link.href.startsWith('http');
                const isHash = link.href.startsWith('#');
                if (isExternal || isHash) {
                  return (
                    <a
                      key={index}
                      href={link.href}
                      className="text-sm text-slate-600 hover:text-primary transition-colors font-medium"
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                    >
                      {link.label}
                    </a>
                  );
                }
                return (
                  <a
                    key={index}
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href, link.label)}
                    className="text-sm text-slate-600 hover:text-primary transition-colors font-medium cursor-pointer"
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Resources Links */}
          <div className="space-y-3 md:space-y-4">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-900">
              Resources
            </h4>
            <nav className="flex flex-col gap-2 md:gap-3">
              {footerLinks.resources.map((link, index) => {
                const isExternal = link.href.startsWith('http');
                const isHash = link.href.startsWith('#');
                if (isExternal || isHash) {
                  return (
                    <a
                      key={index}
                      href={link.href}
                      className="text-sm text-slate-600 hover:text-primary transition-colors font-medium"
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                    >
                      {link.label}
                    </a>
                  );
                }
                return (
                  <a
                    key={index}
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href, link.label)}
                    className="text-sm text-slate-600 hover:text-primary transition-colors font-medium cursor-pointer"
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Legal Links */}
          <div className="space-y-3 md:space-y-4">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-900">
              Legal
            </h4>
            <nav className="flex flex-col gap-2 md:gap-3">
              {footerLinks.legal.map((link, index) => {
                const isExternal = link.href.startsWith('http');
                const isHash = link.href.startsWith('#');
                if (isExternal || isHash) {
                  return (
                    <a
                      key={index}
                      href={link.href}
                      className="text-sm text-slate-600 hover:text-primary transition-colors font-medium"
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                    >
                      {link.label}
                    </a>
                  );
                }
                return (
                  <a
                    key={index}
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href, link.label)}
                    className="text-sm text-slate-600 hover:text-primary transition-colors font-medium cursor-pointer"
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
        </ScrollReveal>

        {/* Bottom Bar */}
        <ScrollReveal animation="reveal" delay="0.15s">
        <div className="pt-8 border-t border-slate-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
              <p className="text-sm text-slate-600 font-medium">
                © {new Date().getFullYear()} ParaLearn. All rights reserved.
              </p>
              <span className="hidden md:inline text-slate-400">•</span>
              <p className="text-sm text-slate-600 font-medium">
                Proudly built for <span className="text-primary font-black">Africa</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                System Live
              </span>
            </div>
          </div>
        </div>
        </ScrollReveal>
      </div>
      <ComingSoonModal open={comingSoonOpen} onOpenChange={setComingSoonOpen} title={comingSoonTitle} />
    </footer>
  );
};

export default Footer;
