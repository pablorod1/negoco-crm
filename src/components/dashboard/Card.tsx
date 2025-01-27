import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { NumberTicker } from "../ui/number-ticker";

interface Props {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  color: string;
}

export default function DashboardCard({
  title,
  value,
  icon,
  description,
  color,
}: Props) {
  return (
    <Card className="relative flex flex-col h-full">
      <div
        className={`w-fit p-2 rounded-lg absolute top-4 right-4 ${
          color === "pending"
            ? "bg-[var(--bg-pending)]"
            : color === "warning"
            ? "bg-[var(--bg-warning)]"
            : color === "success"
            ? "bg-[var(--bg-success)]"
            : color === "danger"
            ? "bg-[var(--danger-color)]"
            : color === "primary"
            ? "bg-[var(--primary-color-100)]"
            : ""
        }`}
      >
        {icon}
      </div>
      <CardHeader>
        <CardTitle>
          <h3
            className={` text-xl 
            ${
              color === "pending"
                ? "text-[var(--pending-color)]"
                : color === "warning"
                ? "text-[var(--warning-color)]"
                : color === "success"
                ? "text-[var(--success-color)]"
                : color === "danger"
                ? "text-[var(--danger-color)]"
                : color === "primary"
                ? "text-[var(--primary-color-800)]"
                : "text-gray-800"
            }
            `}
          >
            {title}
          </h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <NumberTicker
          value={parseInt(value)}
          className="whitespace-pre-wrap text-4xl font-bold text-[var(--primary-color-950)] tracking-tighter"
        />
      </CardContent>
      <CardFooter>
        <p className="text-sm text-gray-500 self-end">{description}</p>
      </CardFooter>
    </Card>
  );
}
