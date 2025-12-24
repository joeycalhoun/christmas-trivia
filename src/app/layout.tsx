import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Christmas Trivia',
  description: 'A festive Christmas trivia game for the whole family!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-[100dvh] bg-black text-white antialiased selection:bg-yellow-300/40 selection:text-white">
        {children}
      </body>
    </html>
  )
}



