"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/core/contexts/UserContext";
import { Users, Crown, Zap } from "lucide-react";

interface PlanInfo {
  plan: {
    id: number;
    name: string;
    max_members: number | null;
  };
  current_members: number;
  can_add_members: boolean;
}

interface UserLimitBarProps {
  onLimitReached: (canAdd: boolean) => void;
}

export default function UserLimitBar({ onLimitReached }: UserLimitBarProps) {
  const { userData } = useUser();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlanInfo = async () => {
      if (!userData) return;

      try {
        const res = await fetch(`/api/v2/users/${userData.id}/plan-info`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const { success, data } = await res.json();
        if (success) {
          setPlanInfo(data);
          onLimitReached(data.can_add_members);
        }
      } catch (error) {
        console.error("Error fetching plan info:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanInfo();
  }, [userData, onLimitReached]);

  if (loading || !planInfo) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-2 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const { plan, current_members } = planInfo;
  const maxMembers = plan.max_members;
  const progressValue = maxMembers
    ? maxMembers < current_members
      ? 100
      : (current_members / maxMembers) * 100
    : 0;
  const isUnlimited = maxMembers === null;

  const getPlanIcon = () => {
    switch (plan.name) {
      case "Starter":
        return <Users className="w-4 h-4" />;
      case "Pro":
        return <Zap className="w-4 h-4" />;
      case "Elite":
        return <Crown className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getPlanColor = () => {
    switch (plan.name) {
      case "Starter":
        return "text-blue-600";
      case "Pro":
        return "text-purple-600";
      case "Elite":
        return "text-amber-600";
      default:
        return "text-gray-600";
    }
  };

  const getProgressColor = () => {
    if (isUnlimited) return "bg-amber-500";
    if (progressValue >= 90) return "bg-red-500";
    if (progressValue >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={getPlanColor()}>{getPlanIcon()}</div>
          <span className="text-sm font-medium text-gray-900">
            Plan {plan.name}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          {isUnlimited ? (
            <span className="flex items-center gap-1">
              <span className="text-amber-600 font-medium">Ilimitado</span>
            </span>
          ) : (
            <span>
              {current_members} de {maxMembers} usuarios
            </span>
          )}
        </div>
      </div>

      {!isUnlimited && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor()}`}
              style={{ width: `${progressValue}%` }}
            ></div>
          </div>

          {progressValue >= 90 && (
            <div className="text-xs text-red-600 font-medium">
              ⚠️ Te estás acercando al límite de usuarios
            </div>
          )}

          {!planInfo.can_add_members && (
            <div className="text-xs text-red-600 font-medium">
              🚫 Has alcanzado el límite de usuarios para tu plan
            </div>
          )}
        </>
      )}

      {isUnlimited && (
        <div className="text-xs text-amber-600 font-medium">
          ✨ Usuarios ilimitados con tu plan Elite
        </div>
      )}
    </div>
  );
}
