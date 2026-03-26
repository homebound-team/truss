import { expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { toHaveStyle } from "@homebound/truss/vitest";

expect.extend({ toHaveStyle });
