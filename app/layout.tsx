import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ErrorBoundary } from "@/components/error-boundary"
import { ChatBot } from "@/components/chatbot"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BRR Demo - ITSoli",
  description: "Business Requirements Review Demo Application powered by ITSoli",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
          {children}
          <ChatBot />
        </ErrorBoundary>
      </body>
    </html>
  )
}
