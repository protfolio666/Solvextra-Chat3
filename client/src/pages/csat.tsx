import { useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function CsatPage() {
  const { ticketId } = useParams();
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: ticket } = useQuery<{ id: string; title: string; ticketNumber: string; conversationId: string }>({
    queryKey: [`/api/public/tickets/${ticketId}`],
    enabled: !!ticketId,
  });

  const submitRatingMutation = useMutation({
    mutationFn: async (data: { rating: number; feedback: string }) => {
      if (!ticket?.conversationId) {
        throw new Error("Ticket conversation not found");
      }
      return apiRequest("POST", "/api/csat-ratings", {
        conversationId: ticket.conversationId,
        ticketId,
        ...data,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = () => {
    if (rating > 0) {
      submitRatingMutation.mutate({ rating, feedback });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Thank You!</CardTitle>
            <CardDescription>Your feedback has been submitted successfully</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              We appreciate you taking the time to share your experience with us.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Rate Your Experience</CardTitle>
          <CardDescription>
            {ticket 
              ? `${ticket.ticketNumber || `Ticket #${ticket.id.slice(0, 8)}`} - ${ticket.title}` 
              : "How was your support experience?"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
                data-testid={`star-${star}`}
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              {rating === 1 && "Poor"}
              {rating === 2 && "Fair"}
              {rating === 3 && "Good"}
              {rating === 4 && "Very Good"}
              {rating === 5 && "Excellent"}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Feedback (Optional)</label>
            <Textarea
              placeholder="Tell us more about your experience..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[100px]"
              data-testid="textarea-feedback"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitRatingMutation.isPending}
            className="w-full"
            data-testid="button-submit-rating"
          >
            {submitRatingMutation.isPending ? "Submitting..." : "Submit Rating"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
