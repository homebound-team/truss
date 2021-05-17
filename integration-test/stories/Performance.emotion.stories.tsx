/** @jsx jsx */
import React from "react";
import { jsx } from "@emotion/react";
import { Meta } from "@storybook/react";
import { Css } from "../Css";

export default {
  title: "Emotion",
} as Meta;

export const Foo = () => {
  return <div>Foo</div>;
};

export const LargeTable = () => {
  return (
    <table>
      <tbody>
        {zeroTo(1000).map((i) => {
          return <Row key={i} i={i} />;
        })}
      </tbody>
    </table>
  );
};

function Row(props: { i: number }) {
  const { i } = props;
  return (
    <tr>
      {zeroTo(7).map((j) => {
        return (
          <td key={j} css={Css.p1.$}>
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
