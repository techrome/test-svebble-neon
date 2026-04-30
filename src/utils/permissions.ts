export type PermissionTree = { readonly [k: string]: PermissionTree | true };

type JoinKeys<A extends string, B extends string> = A extends ""
  ? B
  : `${A}.${B}`;

type BuiltPermissionTree<
  TObj extends PermissionTree,
  TPath extends string = "",
> = {
  [Key in keyof TObj & string]: TObj[Key] extends true
    ? JoinKeys<TPath, Key>
    : TObj[Key] extends PermissionTree
      ? BuiltPermissionTree<TObj[Key], JoinKeys<TPath, Key>>
      : never;
};

export type LeafUnion<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? {
        [Key in keyof T]: LeafUnion<T[Key]>;
      }[keyof T]
    : never;

const basePermissions = {
  user: {
    basicInfo: {
      update: true,
    },
    avatar: {
      create: true,
      update: true,
    },
    username: {
      update: true,
    },
    password: {
      update: true,
    },
    email: {
      update: true,
    },
    delete: true,
  },
  account: {
    read: true,
  },
  messages: {
    create: true,
    update: true,
    delete: true,
    createSpam: true,
  },
  messageAttachments: {
    create: true,
    delete: true,
  },
  channels: {
    create: true,
    update: true,
    delete: true,
  },
} as const satisfies PermissionTree;

const buildPermissions = <TObj extends PermissionTree>(
  perms: TObj
): BuiltPermissionTree<TObj> => {
  const build = (
    node: PermissionTree,
    prefix: string
  ): Record<string, unknown> => {
    let result: Record<string, unknown> = {};

    for (const key of Object.keys(node)) {
      const value = node[key];
      const path = prefix ? `${prefix}.${key}` : key;
      result[key] = value === true ? path : build(value, path);
    }

    return result;
  };

  return build(perms, "") as BuiltPermissionTree<TObj>;
};

export const P = buildPermissions(basePermissions);
