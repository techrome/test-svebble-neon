import React from "react";
import NextImage from "next/image";
import clsx from "clsx";

import DefaultAvatar from "@/components/Avatar/DefaultAvatar";
import { useUser } from "@/trpc/hooks/useUser";
import { env } from "@/utils/env";

type Props = {
  user?: Pick<
    NonNullable<NonNullable<ReturnType<typeof useUser>["data"]>["user"]>,
    "username" | "id" | "image"
  >;
  size?: "sm" | "md" | "lg";
};

export const sizesMap = {
  sm: "min-w-8 size-8",
  md: "min-w-10 size-10",
  lg: "min-w-16 size-16",
} as const satisfies Record<NonNullable<Props["size"]>, string>;

const UserAvatar = ({ user, size = "sm" }: Props) => {
  if (!user) return null;
  return (
    <div className={clsx("relative rounded-full", sizesMap[size])}>
      {user.image ? (
        <NextImage
          className="rounded-full"
          src={`${env.NEXT_PUBLIC_CDN_URL}/${user.image}`}
          alt="user-avatar"
          fill
          unoptimized
        />
      ) : (
        <DefaultAvatar name={user.username} seed={user.id} />
      )}
    </div>
  );
};

export default UserAvatar;
