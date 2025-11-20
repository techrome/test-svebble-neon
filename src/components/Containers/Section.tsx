import React from "react";

type Props = {
  children: React.ReactNode;
} & React.ComponentProps<"div">;

export const Section = ({ children, ...props }: Props) => {
  return (
    <div className="w-full p-2 sm:p-3" {...props}>
      {children}
    </div>
  );
};

export const VerticalStack = ({ children, ...props }: Props) => {
  return (
    <div className="w-full flex flex-col gap-2 sm:gap-3" {...props}>
      {children}
    </div>
  );
};

export const HorizontalStack = ({ children, ...props }: Props) => {
  return (
    <div className="w-full flex flex-wrap gap-2 sm:gap-3" {...props}>
      {children}
    </div>
  );
};
