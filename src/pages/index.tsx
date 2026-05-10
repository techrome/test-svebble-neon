import React from "react";
import { type GetStaticProps } from "next";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import { Paper, Typography } from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";

import { utils as serverUtils } from "@/server";
import { trpc } from "@/trpc";
import {
  defaultPadding,
  HorizontalStack,
  VerticalStack,
} from "@/components/Layout/Containers";
import { CACHE_TIME_MS, CACHE_TIME_S } from "@/utils/cacheTime";
import { type AppPage } from "@/pages/_app";
import ChannelList from "@/components/Chat/ChannelList";
import { APP_NAME } from "@/utils/constants";
import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";
import { useGlobalDrawer } from "@/utils/hooks/useOverlay";
import ChannelListWrapper from "@/components/Chat/ChannelList";

const HomePage: AppPage = () => {
  const globalDrawer = useGlobalDrawer();
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
            `${defaultPadding} flex flex-1 flex-col rounded-none ring ring-mui-divider glow-pulse-wrapper`
          )}
        >
          <Paper
            elevation={5}
            className="rounded-xl p-7 md:p-14 z-10 shadow-none ring ring-mui-divider"
          >
            <VerticalStack addClassName={`${defaultPadding} items-center`}>
              <Typography variant="h2" component="h1" className="text-center">
                Welcome to <strong>{APP_NAME}</strong>
              </Typography>
              <Typography variant="h4" component="h2" className="text-center">
                Pick a channel to get started
              </Typography>
              {firstChannel ? (
                <Link href={ROUTES.channels(String(firstChannel.id))}>
                  <Button color="primary" variant="contained" size="large">
                    Open <span className="underline">#{firstChannel.name}</span>{" "}
                    channel
                  </Button>
                </Link>
              ) : null}
              <Button
                color="inherit"
                variant="contained"
                size="large"
                className="md:hidden"
                onClick={() => {
                  globalDrawer.openDrawer({
                    content: <ChannelListWrapper isDrawer />,
                    props: {
                      title: "Channels",
                      muiDrawerProps: {
                        anchor: "left",
                      },
                    },
                  });
                }}
                startIcon={<ViewListIcon />}
              >
                List of channels
              </Button>
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
