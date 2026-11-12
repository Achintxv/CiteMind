import './globals.css';

export const metadata = {
  title: 'Mini RAG',
  description: 'Ask questions about your documents',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
