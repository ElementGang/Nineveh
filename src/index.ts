import * as asyncHandler from "express-async-handler";
import * as express from "express";
import { config } from "dotenv";

import { HandleInteraction } from "./api";

config();
const app = express();
const port = Number(process.env.PORT ?? 3000);

app.post(
    "/interactions",
    express.raw({ type: () => true }),
    asyncHandler(async (req, res) => {
        await HandleInteraction(
            req.body as Buffer,
            (x) => req.header(x),
            (status, body) => {
                res.status(status);
                res.send(body);
            }
        );
    })
);

app.listen(port);
