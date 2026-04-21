import { Plus_Jakarta_Sans } from "next/font/google";

const loginHeading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-login-heading",
  weight: ["600", "700", "800"],
});

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={`${loginHeading.variable} min-w-0`}>{children}</div>;
}
