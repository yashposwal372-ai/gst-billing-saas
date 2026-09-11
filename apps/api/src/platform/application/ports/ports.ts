export type PortName = `${string}Port`;

export type ApplicationPort<TContract extends object = object> = Readonly<TContract>;

export type UnitOfWorkPort<TResult = unknown> = {
  run<T extends TResult>(work: () => Promise<T>): Promise<T>;
};
