import "./globals.css";
import { Providers } from "@/components/Session";
import AssistantWidget from "@/components/AssistantWidget";

export const metadata = {
  title: "RTI Assist: AI-assisted Right to Information requests",
  description: "Independent academic project: file RTI requests, track them, and receive officer-approved responses drafted with AI help. Not an official government portal.",
};
export const viewport = { width: "device-width", initialScale: 1 };

// Applies the saved theme / text size before first paint so there is no flash.
const THEME_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('rti-prefs')||'{}');var d=p.theme==='dark'||((!p.theme||p.theme==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');if(p.textSize==='large')r.classList.add('text-large');if(p.textSize==='xlarge')r.classList.add('text-xlarge');if(p.language==='hi')r.lang='hi';}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <Providers>
          <a href="#main" className="skip-link">Skip to main content</a>
          {children}
          <AssistantWidget />
        </Providers>
      </body>
    </html>
  );
}
