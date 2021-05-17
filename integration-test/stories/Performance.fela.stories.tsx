/** @jsx fe */
import React from "react";
import { fe } from "react-fela";
import { Meta } from "@storybook/react";
import { Css } from "../Css";
import { createRenderer } from "fela";
import { RendererProvider } from "react-fela";

const renderer = createRenderer();
export default {
  title: "Fela",
  decorators: [
    (story) => {
      return <RendererProvider renderer={renderer}>{story()}</RendererProvider>;
    },
  ],
} as Meta;

export const LargeTable = () => {
  return (
    <table>
      {zeroTo(1000).map((i) => {
        return <Row i={i} />;
      })}
    </table>
  );
};

function Row(props: { i: number }) {
  const { i } = props;
  return (
    <tr>
      {zeroTo(7).map((j) => {
        return (
          <td css={Css.p1.$}>
            cell {i} x {j}
          </td>
        );
      })}
    </tr>
  );
}

function zeroTo(n: number): number[] {
  return [...Array(n).keys()];
}
