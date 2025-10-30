import type React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createContext, useContext } from 'react';

type Variant =
  | 'primary'
  | 'secondary'
  | 'outline-light'
  | 'outline-secondary'
  | 'outline-primary'
  | 'outline-danger'
  | 'success'
  | 'danger';

type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> & {
  variant?: Variant;
  size?: ButtonSize;
};

type BadgeVariant = 'info' | 'secondary' | 'dark' | 'success' | 'warning';

type RowProps = React.HTMLAttributes<HTMLDivElement> & {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

type ColProps = React.HTMLAttributes<HTMLDivElement> & {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

type FormGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  controlId?: string;
  as?: any;
};

type FormControlProps = React.InputHTMLAttributes<HTMLInputElement> & {
  as?: 'textarea';
  rows?: number;
};

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

type FormCheckProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  type?: 'switch' | 'checkbox' | 'radio';
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const buttonVariantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  success: 'btn-primary',
  secondary: 'btn-secondary',
  'outline-primary': 'btn-secondary',
  'outline-light': 'btn-secondary',
  'outline-secondary': 'btn-secondary',
  'outline-danger': 'btn-danger',
  danger: 'btn-danger',
};

const buttonSizeClass: Record<ButtonSize, string> = {
  sm: 'px-4 py-1.5 text-xs',
  md: '',
  lg: 'px-6 py-3 text-base',
};

export const Button = ({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) => (
  <button className={cx(buttonVariantClass[variant], buttonSizeClass[size], className)} {...props}>
    {children}
  </button>
);

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  animation?: 'border' | 'grow';
  size?: 'sm' | 'md';
}

export const Spinner = ({ className, size = 'md', ...props }: SpinnerProps) => {
  const dimension = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-white/40 border-t-white align-middle',
        dimension,
        className,
      )}
      role="status"
      aria-live="polite"
      {...props}
    />
  );
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  bg?: BadgeVariant;
  text?: 'dark' | 'light';
}

const badgeVariantClass: Record<BadgeVariant, string> = {
  info: 'bg-aurora/10 border border-aurora/40 text-aurora',
  secondary: 'bg-slate-800/70 border border-slate-700/60 text-slate-200',
  dark: 'bg-slate-950/80 border border-slate-700/60 text-slate-200',
  success: 'bg-emerald-500/10 border border-emerald-400/40 text-emerald-200',
  warning: 'bg-amber-500/10 border border-amber-400/40 text-amber-200',
};

export const Badge = ({ bg = 'info', text, className, children, ...props }: BadgeProps) => (
  <span
    className={cx(
      'inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.3em]',
      badgeVariantClass[bg],
      text === 'dark' && 'text-slate-900',
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

export const Card = Object.assign(
  ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cx('surface-card', className)} {...props} />
  ),
  {
    Body: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={cx('flex flex-col gap-4', className)} {...props} />
    ),
    Header: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={cx('flex items-center justify-between', className)} {...props} />
    ),
    Title: ({ className, as: Component = 'h3', ...props }: any) => (
      <Component className={cx('section-heading text-xl', className)} {...props} />
    ),
    Subtitle: ({ className, as: Component = 'h4', ...props }: any) => (
      <Component className={cx('text-sm font-semibold uppercase tracking-[0.3em] text-slate-400', className)} {...props} />
    ),
    Text: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className={cx('text-sm text-slate-400', className)} {...props} />
    ),
  },
);

export const InputGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cx('flex items-stretch gap-2', className)} {...props} />
);

const columnClassMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

const responsiveColumnClassMap = {
  sm: {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'sm:grid-cols-5',
    6: 'sm:grid-cols-6',
    7: 'sm:grid-cols-7',
    8: 'sm:grid-cols-8',
    9: 'sm:grid-cols-9',
    10: 'sm:grid-cols-10',
    11: 'sm:grid-cols-11',
    12: 'sm:grid-cols-12',
  },
  md: {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
    7: 'md:grid-cols-7',
    8: 'md:grid-cols-8',
    9: 'md:grid-cols-9',
    10: 'md:grid-cols-10',
    11: 'md:grid-cols-11',
    12: 'md:grid-cols-12',
  },
  lg: {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
    7: 'lg:grid-cols-7',
    8: 'lg:grid-cols-8',
    9: 'lg:grid-cols-9',
    10: 'lg:grid-cols-10',
    11: 'lg:grid-cols-11',
    12: 'lg:grid-cols-12',
  },
  xl: {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
    7: 'xl:grid-cols-7',
    8: 'xl:grid-cols-8',
    9: 'xl:grid-cols-9',
    10: 'xl:grid-cols-10',
    11: 'xl:grid-cols-11',
    12: 'xl:grid-cols-12',
  },
} as const;

const spanClassMap: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
};

const responsiveSpanClassMap = {
  sm: {
    1: 'sm:col-span-1',
    2: 'sm:col-span-2',
    3: 'sm:col-span-3',
    4: 'sm:col-span-4',
    5: 'sm:col-span-5',
    6: 'sm:col-span-6',
    7: 'sm:col-span-7',
    8: 'sm:col-span-8',
    9: 'sm:col-span-9',
    10: 'sm:col-span-10',
    11: 'sm:col-span-11',
    12: 'sm:col-span-12',
  },
  md: {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
    4: 'md:col-span-4',
    5: 'md:col-span-5',
    6: 'md:col-span-6',
    7: 'md:col-span-7',
    8: 'md:col-span-8',
    9: 'md:col-span-9',
    10: 'md:col-span-10',
    11: 'md:col-span-11',
    12: 'md:col-span-12',
  },
  lg: {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3',
    4: 'lg:col-span-4',
    5: 'lg:col-span-5',
    6: 'lg:col-span-6',
    7: 'lg:col-span-7',
    8: 'lg:col-span-8',
    9: 'lg:col-span-9',
    10: 'lg:col-span-10',
    11: 'lg:col-span-11',
    12: 'lg:col-span-12',
  },
  xl: {
    1: 'xl:col-span-1',
    2: 'xl:col-span-2',
    3: 'xl:col-span-3',
    4: 'xl:col-span-4',
    5: 'xl:col-span-5',
    6: 'xl:col-span-6',
    7: 'xl:col-span-7',
    8: 'xl:col-span-8',
    9: 'xl:col-span-9',
    10: 'xl:col-span-10',
    11: 'xl:col-span-11',
    12: 'xl:col-span-12',
  },
} as const;

export const Row = ({ xs = 12, sm, md, lg, xl, className, ...props }: RowProps) => {
  const classes = ['grid', 'gap-4', columnClassMap[xs] ?? 'grid-cols-12'];
  if (sm && responsiveColumnClassMap.sm[sm]) classes.push(responsiveColumnClassMap.sm[sm]!);
  if (md && responsiveColumnClassMap.md[md]) classes.push(responsiveColumnClassMap.md[md]!);
  if (lg && responsiveColumnClassMap.lg[lg]) classes.push(responsiveColumnClassMap.lg[lg]!);
  if (xl && responsiveColumnClassMap.xl[xl]) classes.push(responsiveColumnClassMap.xl[xl]!);
  return <div className={cx(...classes, className)} {...props} />;
};

export const Col = ({ xs, sm, md, lg, xl, className, ...props }: ColProps) => {
  const classes = ['col-span-12'];
  if (xs && spanClassMap[xs]) classes.push(spanClassMap[xs]);
  if (sm && responsiveSpanClassMap.sm[sm]) classes.push(responsiveSpanClassMap.sm[sm]!);
  if (md && responsiveSpanClassMap.md[md]) classes.push(responsiveSpanClassMap.md[md]!);
  if (lg && responsiveSpanClassMap.lg[lg]) classes.push(responsiveSpanClassMap.lg[lg]!);
  if (xl && responsiveSpanClassMap.xl[xl]) classes.push(responsiveSpanClassMap.xl[xl]!);
  return <div className={cx(...classes, className)} {...props} />;
};

export const Form = Object.assign(
  ({ className, ...props }: React.FormHTMLAttributes<HTMLFormElement>) => (
    <form className={className} {...props} />
  ),
  {
    Group: ({ className, controlId, as: Component = 'div', ...props }: FormGroupProps & { as?: any }) => (
      <FormContext.Provider value={controlId}>
        <Component className={cx('flex flex-col gap-2', className)} {...props} />
      </FormContext.Provider>
    ),
    Label: ({ className, htmlFor, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => {
      const controlId = useContext(FormContext);
      return <label className={cx('form-label', className)} htmlFor={htmlFor ?? controlId} {...props} />;
    },
    Control: ({ as, className, id, ...props }: FormControlProps) => {
      const controlId = useContext(FormContext);
      const controlIdOrProvided = id ?? controlId;
      if (as === 'textarea') {
        const { rows, ...rest } = props;
        return <textarea id={controlIdOrProvided} className={cx('form-control', className)} rows={rows ?? 3} {...rest} />;
      }
      return <input id={controlIdOrProvided} className={cx('form-control', className)} {...props} />;
    },
    Select: ({ className, children, id, ...props }: FormSelectProps & { id?: string }) => {
      const controlId = useContext(FormContext);
      return (
        <select id={id ?? controlId} className={cx('form-select', className)} {...props}>
          {children}
        </select>
      );
    },
    Text: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <small className={cx('text-xs text-slate-500', className)} {...props} />
    ),
    Check: ({ id, label, type = 'checkbox', className, ...props }: FormCheckProps) => (
      <label htmlFor={id} className={cx('flex items-center gap-3 text-sm text-slate-300', className)}>
        <input id={id} type={type === 'radio' ? 'radio' : 'checkbox'} className="h-4 w-4" {...props} />
        {label}
      </label>
    ),
  },
);

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  striped?: boolean;
  bordered?: boolean;
  hover?: boolean;
  responsive?: boolean;
  size?: 'sm' | 'lg';
}

export const Table = ({ striped, bordered, hover, responsive, size, className, children, ...props }: TableProps) => {
  const tableClass = cx(
    'data-table',
    striped && 'table-striped',
    bordered && 'table-bordered',
    hover && 'table-hover',
    size === 'sm' && 'table-sm',
    className,
  );
  const table = (
    <table className={tableClass} {...props}>
      {children}
    </table>
  );
  if (responsive) {
    return <div className="table-responsive">{table}</div>;
  }
  return table;
};

export const ProgressBar = ({ now = 0, className }: { now?: number; className?: string }) => (
  <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-800/60', className)}>
    <div
      className="h-full rounded-full bg-gradient-to-r from-aurora to-neon"
      style={{ width: `${Math.min(100, Math.max(0, now))}%` }}
    />
  </div>
);

interface ModalContextValue {
  onHide?: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);
const FormContext = createContext<string | undefined>(undefined);

interface ModalProps {
  show: boolean;
  onHide?: () => void;
  size?: 'sm' | 'lg' | 'xl';
  centered?: boolean;
  children: ReactNode;
}

const modalSizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
};

export const Modal = Object.assign(
  ({ show, onHide, size = 'sm', children }: ModalProps) => {
    if (!show) return null;
    return (
      <ModalContext.Provider value={{ onHide }}>
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className={cx('modal-panel relative', modalSizeClass[size] ?? 'max-w-2xl')}>{children}</div>
        </div>
      </ModalContext.Provider>
    );
  },
  {
    Header: ({ closeButton, closeLabel = 'Close', className, children }: any) => {
      const ctx = useContext(ModalContext);
      return (
        <div className={cx('flex items-start justify-between gap-3', className)}>
          <div>{children}</div>
          {closeButton ? (
            <button
              type="button"
              className="modal-close"
              aria-label={closeLabel}
              onClick={() => ctx?.onHide?.()}
            >
              ×
            </button>
          ) : null}
        </div>
      );
    },
    Body: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={cx('mt-4 flex flex-col gap-4', className)} {...props} />
    ),
    Footer: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={cx('modal-actions', className)} {...props} />
    ),
    Title: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h3 className={cx('modal-title', className)} {...props} />
    ),
  },
);

export const Breadcrumb = Object.assign(
  ({ className, children }: { className?: string; children: ReactNode }) => (
    <nav className={className} aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
        {children}
      </ol>
    </nav>
  ),
  {
    Item: ({ active, href, children }: { active?: boolean; href?: string; children: ReactNode }) => (
      <li className="flex items-center gap-2">
        {href && !active ? (
          <a href={href} className="text-slate-300 transition hover:text-white">
            {children}
          </a>
        ) : (
          <span className={active ? 'text-white' : 'text-slate-400'}>{children}</span>
        )}
        <span aria-hidden="true" className="text-slate-600">
          ›
        </span>
      </li>
    ),
  },
);

export const ListGroup = Object.assign(
  ({ className, as: Component = 'div', ...props }: { className?: string; as?: any } & React.HTMLAttributes<HTMLElement>) => (
    <Component className={cx('flex flex-col gap-2', className)} {...props} />
  ),
  {
    Item: ({
      as: Component = 'div',
      action,
      active,
      className,
      style,
      children,
      ...props
    }: {
      as?: any;
      action?: boolean;
      active?: boolean;
      className?: string;
      style?: CSSProperties;
      children: ReactNode;
    } & React.HTMLAttributes<HTMLElement>) => (
      <Component
        className={cx(
          'rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 transition',
          action && 'cursor-pointer hover:border-aurora/40 hover:text-white',
          active && 'border-aurora/50 bg-aurora/10 text-white shadow-glow-sm',
          className,
        )}
        style={style}
        {...props}
      >
        {children}
      </Component>
    ),
  },
);

export const Container = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cx('mx-auto w-full max-w-6xl px-4', className)} {...props} />
);

export default {
  Button,
  Spinner,
  Badge,
  Card,
  Form,
  Modal,
  Table,
  Row,
  Col,
  InputGroup,
  ProgressBar,
  Breadcrumb,
  ListGroup,
  Container,
};
