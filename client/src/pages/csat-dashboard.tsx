import { useQuery } from "@tanstack/react-query";
import { CsatRating } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Smile, Meh, Frown } from "lucide-react";
import { format } from "date-fns";

export default function CsatDashboard() {
  const { data: ratings = [], isLoading } = useQuery<CsatRating[]>({
    queryKey: ["/api/csat-ratings"],
  });

  const averageRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : "0.0";

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-500";
    if (rating >= 3) return "text-yellow-500";
    return "text-red-500";
  };

  const getRatingIcon = (rating: number) => {
    if (rating >= 4) return <Smile className="w-5 h-5 text-green-500" />;
    if (rating >= 3) return <Meh className="w-5 h-5 text-yellow-500" />;
    return <Frown className="w-5 h-5 text-red-500" />;
  };

  const ratingCounts = {
    5: ratings.filter(r => r.rating === 5).length,
    4: ratings.filter(r => r.rating === 4).length,
    3: ratings.filter(r => r.rating === 3).length,
    2: ratings.filter(r => r.rating === 2).length,
    1: ratings.filter(r => r.rating === 1).length,
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading CSAT ratings...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">CSAT Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customer Satisfaction Ratings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Average Rating</CardDescription>
            <CardTitle className="text-3xl">{averageRating} / 5.0</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(Number(averageRating))
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Responses</CardDescription>
            <CardTitle className="text-3xl">{ratings.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Customer feedback received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Rating Distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-2 text-sm">
                <span className="w-8">{rating} ⭐</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{
                      width: `${ratings.length > 0 ? (ratingCounts[rating as keyof typeof ratingCounts] / ratings.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground">
                  {ratingCounts[rating as keyof typeof ratingCounts]}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader>
          <CardTitle>Recent Ratings</CardTitle>
          <CardDescription>Customer feedback and ratings</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {ratings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No CSAT ratings yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...ratings]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((rating) => (
                    <TableRow key={rating.id} data-testid={`rating-row-${rating.id}`}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(rating.createdAt), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {rating.ticketId ? `${rating.ticketId.slice(0, 8)}...` : (
                          <span className="text-muted-foreground italic">No ticket</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRatingIcon(rating.rating)}
                          <span className={`font-semibold ${getRatingColor(rating.rating)}`}>
                            {rating.rating}/5
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {rating.feedback ? (
                          <p className="text-sm text-muted-foreground truncate">
                            {rating.feedback}
                          </p>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No feedback</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
