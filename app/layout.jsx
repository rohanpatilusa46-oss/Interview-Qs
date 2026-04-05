import './globals.css';

export const metadata = {
  title: 'ML Interview Prep',
  description: 'Next.js interview prep app for machine learning concepts, quiz mode, bookmarks, and chat history.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
