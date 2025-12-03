import React from "react";
import {
  Tabs as MuiTabs,
  Tab as MuiTab,
  Box,
  type TabsProps as MuiTabsProps,
  type TabProps as MuiTabProps,
} from "@mui/material";

type TabInfo = {
  value: string;
  label: React.ReactNode;
  panel: React.ReactNode;
} & MuiTabProps;

type Props = {
  tabs: TabInfo[];
} & MuiTabsProps;

const getA11yProps = (baseId: string, value: string) => ({
  id: `${baseId}-tab-${value}`,
  "aria-controls": `${baseId}-tabpanel-${value}`,
});

const Tabs = ({ tabs, ...props }: Props) => {
  const baseId = React.useId();

  return (
    <Box>
      <MuiTabs {...props}>
        {tabs.map((tabInfo) => (
          <MuiTab
            key={tabInfo.value}
            {...getA11yProps(baseId, tabInfo.value)}
            {...tabInfo}
          />
        ))}
      </MuiTabs>
      {tabs.map((tabInfo) => {
        const isActive = props.value === tabInfo.value;
        const ids = getA11yProps(baseId, tabInfo.value);

        return (
          <div
            key={tabInfo.value}
            role="tabpanel"
            hidden={!isActive}
            id={ids["aria-controls"]}
            aria-labelledby={ids.id}
          >
            {isActive && tabInfo.panel}
          </div>
        );
      })}
    </Box>
  );
};

export default Tabs;
