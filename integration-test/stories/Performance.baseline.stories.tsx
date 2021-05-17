import React from "react";
import { Meta } from "@storybook/react";

export default {
  title: "Baseline",
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
          <td>
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
