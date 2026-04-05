import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata = {
  title: 'Interview Intelligence Studio',
  description: 'A polished ML interview prep workspace with concept maps, adaptive quizzes, bookmarks, and deep-dive comparisons.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
