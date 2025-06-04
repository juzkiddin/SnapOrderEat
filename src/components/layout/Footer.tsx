
export default function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t py-8 bg-secondary/50">
      <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
        <p>&copy; {currentYear} SnapOrderEat. All rights reserved.</p>
        <p className="mt-1">Delicious food, delivered fast.</p>
      </div>
    </footer>
  );
}
