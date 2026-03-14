import React from "react";
import { type GetStaticProps } from "next";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import ViewListIcon from "@mui/icons-material/ViewList";
import PersonIcon from "@mui/icons-material/Person";
import { Paper, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import ReplayIcon from "@mui/icons-material/Replay";
import debounce from "lodash/debounce";
import WavingHandIcon from "@mui/icons-material/WavingHand";

import { utils as serverUtils } from "@/server";
import { type RouterInput, trpc } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import { Comment } from "@/components/CommentsList/CommentsList";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import {
  useGlobalDrawer,
  useGlobalModal,
  useLocalDrawer,
  useLocalModal,
} from "@/utils/hooks/useOverlay";
import {
  defaultPadding,
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import { useAppSnackbar } from "@/utils/snackbar";
import {
  CACHE_TIME_MS,
  CACHE_TIME_S,
  minutes,
  seconds,
} from "@/utils/cacheTime";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { SectionWrapper } from "@/pages/app/my-profile";
import { Divider } from "@/components/Layout/Dividers";
import { userLoginLifecycle } from "@/trpc/helpers/userLifecycle";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import z from "zod";
import { Text } from "@/utils/validators/helpers/text";
import { useUser } from "@/trpc/hooks/useUser";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/Fields/Input";
import { type AppPage } from "@/pages/_app";
import { useAuthModal } from "@/utils/hooks/useAuthModal";
import {
  type MessageCreateFormValues,
  makeMessageCreateSchemaForm,
} from "@/utils/validators/shared/messages";
import { useRouter } from "next/router";
import { getRouterQueryValue } from "@/utils/query";
import { useWebsockets } from "@/trpc/hooks/useWebsockets";
import {
  getChannelId,
  subscribeWs,
  WebsocketEventName,
} from "@/trpc/helpers/websockets";
import { getQueryKey } from "@trpc/react-query";
import ChannelList from "@/components/Chat/ChannelList";
import { APP_NAME } from "@/utils/constants";
import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";

const HomePage: AppPage = () => {
  const channels = trpc.channels.get.useQuery(undefined, {
    staleTime: CACHE_TIME_MS.NORMAL,
  });
  const firstChannel = channels.data?.items[0];
  return (
    <div className="flex-1 flex flex-col mt-3 min-h-0">
      <HorizontalStack addClassName="flex-1 min-h-0">
        <ChannelList />
        <Paper
          elevation={1}
          className={clsx(
            `${defaultPadding} flex flex-1 flex-col rounded-none ring ring-[var(--mui-palette-divider)] glow-pulse-wrapper`
          )}
        >
          <Paper
            elevation={5}
            className="rounded-xl p-14 z-10 shadow-none ring ring-[var(--mui-palette-divider)]"
          >
            <VerticalStack addClassName={`${defaultPadding} items-center`}>
              <Typography variant="h2" component="h1" className="text-center">
                Welcome to <strong>{APP_NAME}</strong>
              </Typography>
              <Typography variant="h4" component="h2" className="text-center">
                Pick a channel to get started.
              </Typography>
              {firstChannel ? (
                <Link href={ROUTES.channels(String(firstChannel.id))}>
                  <Button color="primary" variant="contained" size="large">
                    Open <span className="underline">#{firstChannel.name}</span>{" "}
                    channel
                  </Button>
                </Link>
              ) : null}
            </VerticalStack>
          </Paper>
        </Paper>
      </HorizontalStack>
    </div>
  );
};

HomePage.disablePadding = true;

export const getStaticProps = (async () => {
  const helpers = await serverUtils.getPrefetcher();
  await helpers.channels.get.prefetch(undefined, {
    staleTime: CACHE_TIME_MS.NORMAL,
  });
  return {
    props: {
      trpcState: helpers.dehydrate(),
    },
    revalidate: CACHE_TIME_S.NORMAL,
  };
}) satisfies GetStaticProps;

export default HomePage;
