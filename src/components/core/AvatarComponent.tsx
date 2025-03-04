import { User } from "@/lib/core/types";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default function AvatarComponent({
  userData,
  className,
  textSize,
}: {
  userData: User;
  className?: string;
  textSize?: string;
}) {
  return (
    <Avatar className={`${className} rounded-lg`}>
      <AvatarImage
        src={userData.image as string}
        alt={userData.name as string}
        className="w-full h-full object-cover object-center"
      />
      <AvatarFallback className={`rounded-lg ${textSize}`}>
        {userData.name.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
