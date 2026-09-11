import { createFileRoute } from "@tanstack/react-router";
import { BookingPage } from "@/components/booking-page";

export const Route = createFileRoute("/book-a-tour")({ component: BookingPage });
