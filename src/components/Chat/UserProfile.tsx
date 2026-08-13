import React from "react";
import UserAvatar from "@/components/Avatar/UserAvatar";
import Button from "@/components/Button/Button";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import { Divider } from "@/components/Layout/Dividers";
import Skeleton from "@/components/Skeleton/Skeleton";
import { trpc } from "@/trpc";
import { CACHE_TIME_MS } from "@/utils/cacheTime";
import useAppQuery from "@/utils/hooks/useAppQuery";
import { Chip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

const UserProfile = ({ userId }: { userId: string }) => {
  const userProfile = useAppQuery(
    trpc.user.viewOtherUserProfile.useQuery(
      { userId },
      { staleTime: CACHE_TIME_MS.QUICK }
    )
  );
  const utils = trpc.useUtils();

  if (userProfile.isLoading) {
    return (
      <VerticalStack>
        <HorizontalStack addClassName="items-center">
          <Skeleton variant="circular" height={80} width={80} />
          <div className="flex-1 flex flex-col">
            <Skeleton className="flex-1" />
            <Skeleton className="flex-1" />
          </div>
        </HorizontalStack>
        <Skeleton />
      </VerticalStack>
    );
  }

  if (userProfile.isError || !userProfile.data) {
    return (
      <div className="flex justify-center">
        <HorizontalStack addClassName="items-center">
          <Typography color="warning" variant="subtitle2">
            Failed to load user
          </Typography>
          <Button
            variant="contained"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={() => {
              utils.user.viewOtherUserProfile.invalidate({ userId });
            }}
            isLoading={userProfile.isFetching}
          >
            Retry
          </Button>
        </HorizontalStack>
      </div>
    );
  }

  const userData = userProfile.data;

  return (
    <VerticalStack>
      <HorizontalStack addClassName="items-center">
        <UserAvatar user={userData} size="xl" />
        <div>
          <Typography>
            {userData.name}{" "}
            <Chip component={"span"} label={userData.role} size="small" />
          </Typography>
          <Typography color="textSecondary">
            {userData.displayUsername}
          </Typography>
        </div>
      </HorizontalStack>
      <Divider />
      <HorizontalStack>
        <Typography>Joined: {userData.createdAtDisplay}</Typography>
      </HorizontalStack>
    </VerticalStack>
  );
};

export default UserProfile;
