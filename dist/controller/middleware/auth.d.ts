export declare const secret: string;
export declare const jwtAuthen: {
    (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction): Promise<void>;
    unless: typeof import("express-unless").unless;
};
export declare function generateToken(payload: any): string;
//# sourceMappingURL=auth.d.ts.map