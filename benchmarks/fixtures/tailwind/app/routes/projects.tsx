import { useState } from "react";

import { cn } from "../cn";
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
      <div className={pageHead}>
        <div>
          <h1 className={pageTitle}>Projects</h1>
          <p className={pageSub}>
            Every deployable service in the Nimbus org, with its current rollout state and
            quarter-to-date spend.
          </p>
        </div>
        <div className={pageActions}>
          <button type="button" className={button({ tone: "secondary" })}>
            Import
          </button>
          <button type="button" className={button({ tone: "primary" })}>
            <PlusIcon />
            New project
          </button>
        </div>
      </div>

      <div className={s.toolbar}>
        <div className={cn(s.searchWrap, fieldGrow)}>
          <span className={s.searchIcon}>
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Filter by name or repository…"
            aria-label="Filter projects"
            className={cn(field, s.fieldSearch)}
          />
        </div>
        <select aria-label="Status filter" defaultValue="all" className={cn(field, s.select)}>
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="staging">Staging</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
        <select aria-label="Owner filter" defaultValue="any" className={cn(field, s.select)}>
          <option value="any">Any owner</option>
          <option value="me">Owned by me</option>
        </select>
        <div className={segmented}>
          {views.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={segButton({ active: view === v })}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col" className={cn(s.th, s.colTight)}>
                <input type="checkbox" aria-label="Select all projects" className={s.check} />
              </th>
              <th scope="col" className={s.th}>
                Project
              </th>
              <th scope="col" className={s.th}>
                Owner
              </th>
              <th scope="col" className={s.th}>
                Status
              </th>
              <th scope="col" className={s.th}>
                Rollout
              </th>
              <th scope="col" className={cn(s.th, s.colNum)}>
                QTD spend
              </th>
              <th scope="col" className={s.th}>
                Updated
              </th>
              <th scope="col" className={cn(s.th, s.colTight)}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, i) => {
              const last = i === projects.length - 1;
              const td = cn(s.td, last && s.tdLast);
              return (
                <tr key={project.repo} className={s.tr}>
                  <td className={cn(td, s.colTight)}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${project.name}`}
                      className={s.check}
                    />
                  </td>
                  <td className={td}>
                    <div className={s.cellName}>{project.name}</div>
                    <div className={s.cellRepo}>{project.repo}</div>
                  </td>
                  <td className={td}>
                    <span className={s.owner}>
                      <span aria-hidden="true" className={avatar({ size: "sm" })}>
                        {project.initials}
                      </span>
                      {project.owner}
                    </span>
                  </td>
                  <td className={td}>
                    <span className={badge({ status: project.status })}>
                      <span className={badgeDot} />
                      {statusLabels[project.status]}
                    </span>
                  </td>
                  <td className={td}>
                    <span className={s.progress}>
                      <span className={s.progressTrack}>
                        {/* A runtime value, so it goes in `style`: Tailwind only
                            emits rules for class names it finds in the source. */}
                        <span
                          className={s.progressFill}
                          style={{ width: `${project.progress}%` }}
                        />
                      </span>
                      <span className={s.progressNum}>{project.progress}%</span>
                    </span>
                  </td>
                  <td className={cn(td, s.colNum)}>{project.budget}</td>
                  <td className={td}>{project.updated}</td>
                  <td className={cn(td, s.colTight)}>
                    <button
                      type="button"
                      aria-label={`Actions for ${project.name}`}
                      className={iconButton}
                    >
                      <DotsIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={s.tableFoot}>
          <span>Showing 8 of 34 projects</span>
          <ul className={s.pager}>
            <li>
              <button type="button" className={pageBtn()}>
                Prev
              </button>
            </li>
            <li>
              <button type="button" aria-current="page" className={pageBtn({ current: true })}>
                1
              </button>
            </li>
            <li>
              <button type="button" className={pageBtn()}>
                2
              </button>
            </li>
            <li>
              <button type="button" className={pageBtn()}>
                3
              </button>
            </li>
            <li>
              <button type="button" className={pageBtn()}>
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
  toolbar: "flex items-center gap-10 flex-wrap mb-14",
  searchWrap: "relative flex",
  searchIcon:
    "absolute left-10 top-1/2 -translate-y-1/2 text-faint pointer-events-none leading-[0]",
  fieldSearch: "pl-31 w-full",
  select: "appearance-none pr-24",

  tableWrap: "overflow-x-auto bg-surface border border-border rounded-14 shadow-sm",
  table: "w-full min-w-860 border-separate border-spacing-0",
  th: "py-10 px-14 bg-surface2 border-b border-border text-11-5 font-semibold uppercase tracking-[0.05em] text-muted text-left whitespace-nowrap",
  tr: "bg-transparent transition-colors duration-120 hover:bg-surface2",
  td: "py-11 px-14 border-b border-border text-13-5 align-middle",
  tdLast: "border-b-0",
  colNum: "text-right tabular-nums",
  colTight: "w-[1%] whitespace-nowrap",
  check: "accent-accent cursor-pointer",
  cellName: "font-semibold",
  cellRepo: "font-mono text-11-5 text-faint mt-2",
  owner: "flex items-center gap-8 whitespace-nowrap",

  progress: "flex items-center gap-9 min-w-130",
  progressTrack: "grow h-5 rounded-pill bg-surface3 overflow-hidden",
  progressFill: "h-full rounded-pill bg-accent",
  progressNum: "text-11-5 text-muted tabular-nums w-30 text-right",

  tableFoot:
    "flex items-center justify-between gap-14 flex-wrap py-11 px-14 border-t border-border text-12-5 text-muted",
  pager: "flex gap-4",
};
