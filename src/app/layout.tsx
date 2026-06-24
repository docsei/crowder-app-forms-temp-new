import { GeistSans } from "geist/font/sans"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

export const metadata: Metadata = {
  title: "Resumen",
  description: "Páginas del panel para resumir datos.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${GeistSans.className} min-h-full bg-background text-foreground antialiased`}
      >
        <ThemeProvider
          defaultTheme="system"
          disableTransitionOnChange
          attribute="class"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
