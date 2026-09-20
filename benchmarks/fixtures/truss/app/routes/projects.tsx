import { useState } from "react";

import { Css } from "~/Css";
import { projects, statusLabels } from "../data";
import { DotsIcon, PlusIcon, SearchIcon } from "../icons";
import {
  avatar,
  badge,
  badgeDot,
  button,
  field,
  fieldGrow,
  iconButton,
  pageActions,
  pageBtn,
  pageHead,
  pageSub,
  pageTitle,
  segButton,
  segmented,
} from "../ui";

const views = ["Table", "Board"];

export function meta() {
  return [{ title: "Projects · Nimbus" }];
}

export default function Projects() {
  const [view, setView] = useState("Table");

  return (
    <>
      <div css={pageHead}>
        <div>
          <h1 css={pageTitle}>Projects</h1>
          <p css={pageSub}>
            Every deployable service in the Nimbus org, with its current rollout state and
            quarter-to-date spend.
          </p>
        </div>
        <div css={pageActions}>
          <button type="button" css={button({ tone: "secondary" })}>
            Import
          </button>
          <button type="button" css={button({ tone: "primary" })}>
            <PlusIcon />
            New project
          </button>
        </div>
      </div>

      <div css={s.toolbar}>
        <div css={{ ...s.searchWrap, ...fieldGrow }}>
          <span css={s.searchIcon}>
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Filter by name or repository…"
            aria-label="Filter projects"
            css={{ ...field, ...s.fieldSearch }}
          />
        </div>
        <select aria-label="Status filter" defaultValue="all" css={{ ...field, ...s.select }}>
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="staging">Staging</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
        <select aria-label="Owner filter" defaultValue="any" css={{ ...field, ...s.select }}>
          <option value="any">Any owner</option>
          <option value="me">Owned by me</option>
        </select>
        <div css={segmented}>
          {views.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              css={segButton({ active: view === v })}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div css={s.tableWrap}>
        <table css={s.table}>
          <thead>
            <tr>
              <th scope="col" css={{ ...s.th, ...s.colTight }}>
                <input type="checkbox" aria-label="Select all projects" css={s.check} />
              </th>
              <th scope="col" css={s.th}>
                Project
              </th>
              <th scope="col" css={s.th}>
                Owner
              </th>
              <th scope="col" css={s.th}>
                Status
              </th>
              <th scope="col" css={s.th}>
                Rollout
              </th>
              <th scope="col" css={{ ...s.th, ...s.colNum }}>
                QTD spend
              </th>
              <th scope="col" css={s.th}>
                Updated
              </th>
              <th scope="col" css={{ ...s.th, ...s.colTight }}>
                <span css={s.srOnly}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, i) => {
              const last = i === projects.length - 1;
              const td = { ...s.td, ...(last ? s.tdLast : undefined) };
              return (
                <tr key={project.repo} css={s.tr}>
                  <td css={{ ...td, ...s.colTight }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${project.name}`}
                      css={s.check}
                    />
                  </td>
                  <td css={td}>
                    <div css={s.cellName}>{project.name}</div>
                    <div css={s.cellRepo}>{project.repo}</div>
                  </td>
                  <td css={td}>
                    <span css={s.owner}>
                      <span aria-hidden="true" css={avatar({ size: "sm" })}>
                        {project.initials}
                      </span>
                      {project.owner}
                    </span>
                  </td>
                  <td css={td}>
                    <span css={badge({ status: project.status })}>
                      <span css={badgeDot} />
                      {statusLabels[project.status]}
                    </span>
                  </td>
                  <td css={td}>
                    <span css={s.progress}>
                      <span css={s.progressTrack}>
                        {/* A runtime value: Truss writes it to a custom property
                            that one shared `w_var` class reads. */}
                        <span css={{ ...s.progressFill, ...Css.w(`${project.progress}%`).$ }} />
                      </span>
                      <span css={s.progressNum}>{project.progress}%</span>
                    </span>
                  </td>
                  <td css={{ ...td, ...s.colNum }}>{project.budget}</td>
                  <td css={td}>{project.updated}</td>
                  <td css={{ ...td, ...s.colTight }}>
                    <button
                      type="button"
                      aria-label={`Actions for ${project.name}`}
                      css={iconButton}
                    >
                      <DotsIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div css={s.tableFoot}>
          <span>Showing 8 of 34 projects</span>
          <ul css={s.pager}>
            <li>
              <button type="button" css={pageBtn()}>
                Prev
              </button>
            </li>
            <li>
              <button type="button" aria-current="page" css={pageBtn({ current: true })}>
                1
              </button>
            </li>
            <li>
              <button type="button" css={pageBtn()}>
                2
              </button>
            </li>
            <li>
              <button type="button" css={pageBtn()}>
                3
              </button>
            </li>
            <li>
              <button type="button" css={pageBtn()}>
                Next
              </button>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

const s = {
  toolbar: Css.df.aic.gapPx(10).fww.mbPx(14).$,
  searchWrap: Css.relative.df.$,
  searchIcon: Css.absolute
    .leftPx(10)
    .top("50%")
    .transform("translateY(-50%)")
    .faint.pen
    .lh(0).$,
  fieldSearch: Css.plPx(31).w100.$,
  select: Css.appearanceNone.prPx(24).$,

  tableWrap: Css.oxa.bgSurface.ba.bcBorder.br14.shadowSm.$,
  table: Css.w100.mwPx(860).borderCollapse("separate").borderSpacing("0").$,
  th: Css.pyPx(10)
    .pxPx(14)
    .bgSurface2.bb.bcBorder.f11_5.fw6.ttu.ls("0.05em").muted.tal.wsnw.$,
  tr: Css.bgTransparent.transitionFast.onHover.bgSurface2.$,
  td: Css.pyPx(11).pxPx(14).bb.bcBorder.f13_5.vam.$,
  tdLast: Css.add("borderBottomWidth", "0").$,
  colNum: Css.tar.tabularNums.$,
  colTight: Css.w("1%").wsnw.$,
  check: Css.accentColor("var(--accent)").cursorPointer.$,
  cellName: Css.fw6.$,
  cellRepo: Css.fontMono.f11_5.faint.mtPx(2).$,
  owner: Css.df.aic.gapPx(8).wsnw.$,

  progress: Css.df.aic.gapPx(9).mwPx(130).$,
  progressTrack: Css.fg1.hPx(5).brPill.bgSurface3.oh.$,
  progressFill: Css.h100.brPill.bgAccent.$,
  progressNum: Css.f11_5.muted.tabularNums.wPx(30).tar.$,

  tableFoot: Css.df.aic.jcsb
    .gapPx(14)
    .fww.pyPx(11)
    .pxPx(14)
    .bt.bcBorder.f12_5.muted.$,
  pager: Css.df.gapPx(4).$,

  srOnly: Css.absolute
    .sqPx(1)
    .pPx(0)
    .mPx(-1)
    .oh.clipPath("inset(50%)")
    .wsnw.bw("0").$,
};
