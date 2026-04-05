import './globals.css';

export const metadata = {
  title: 'Interview Intelligence Studio',
  description: 'A polished ML interview prep workspace with concept maps, adaptive quizzes, bookmarks, and deep-dive comparisons.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
