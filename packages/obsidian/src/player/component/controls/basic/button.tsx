import "@styles/button.less";

import { useIcon } from "@hook-utils";
import type { ButtonUnstyledProps } from "@mui/base";
import { useButton } from "@mui/base";
import cls from "classnames";
import React from "react";
import { useMergeRefs } from "use-callback-ref";

type ButtonProps = ButtonUnstyledProps & {
  icon: string;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
  function Button(props, ref) {
    const { children, icon } = props;

    const setIconCallback = useIcon([icon]);

    const { active, disabled, focusVisible, getRootProps } = useButton({
      ...props,
      ref,
    });

    const classes = {
        active,
        disabled,
        focusVisible,
      },
      { ref: buttonRef, ...rootProps } = getRootProps();
    return (
      <button
        ref={useMergeRefs([buttonRef, setIconCallback])}
        {...rootProps}
        className={cls("mx__button", classes)}
      >
        {children}
      </button>
    );
  },
);

export default React.memo(Button);
