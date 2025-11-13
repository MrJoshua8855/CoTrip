import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Container } from "@/components/layout/Container"

export default function NotFound() {
  return (
    <Container className="py-16">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                <FileQuestion className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>404 - Page Not Found</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/">Go Home</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/trips">View Trips</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  )
}
