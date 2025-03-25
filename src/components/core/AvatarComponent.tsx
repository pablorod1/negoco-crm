import { User } from "@/lib/core/types";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default function AvatarComponent({
  userData,
  className,
  textSize,
}: {
  userData: Partial<User>;
  className?: string;
  textSize?: string;
}) {
  return (
    <Avatar className={`${className} rounded-lg`}>
      {userData.image ? (
        <AvatarImage
          src={userData.image as string}
          alt={userData.name as string}
          className="w-full h-full object-cover object-center"
        />
      ) : (
        <AvatarFallback className={`rounded-lg ${textSize}`}>
          {(userData.name as string).charAt(0).toUpperCase()}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
