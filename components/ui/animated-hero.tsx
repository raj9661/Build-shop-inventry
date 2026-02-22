"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

function Hero() {
    const [titleNumber, setTitleNumber] = useState(0);
    const titles = useMemo(
        () => ["amazing", "new", "wonderful", "beautiful", "smart"],
        []
    );

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (titleNumber === titles.length - 1) {
                setTitleNumber(0);
            } else {
                setTitleNumber(titleNumber + 1);
            }
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, [titleNumber, titles]);

    return (
        <div className="w-full">
            <div className="container mx-auto">
                <div className="flex gap-8 py-20 lg:py-40 items-center justify-center flex-col">
                    <div>
                        <Button variant="secondary" size="sm" className="gap-2 rounded-full px-4 text-xs font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200">
                            Read our launch article <MoveRight className="w-3 h-3" />
                        </Button>
                    </div>
                    <div className="flex gap-4 flex-col">
                        <h1 className="text-6xl md:text-8xl tracking-tighter text-center font-medium">
                            <span className="text-slate-900">This is something</span>
                            <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1 text-slate-900 font-bold">
                                &nbsp;
                                {titles.map((title, index) => (
                                    <motion.span
                                        key={index}
                                        className="absolute"
                                        initial={{ opacity: 0, y: "-100" }}
                                        transition={{ type: "spring", stiffness: 50 }}
                                        animate={
                                            titleNumber === index
                                                ? {
                                                    y: 0,
                                                    opacity: 1,
                                                }
                                                : {
                                                    y: titleNumber > index ? -150 : 150,
                                                    opacity: 0,
                                                }
                                        }
                                    >
                                        {title}
                                    </motion.span>
                                ))}
                            </span>
                        </h1>

                        <p className="text-base md:text-lg leading-relaxed tracking-tight text-slate-500 max-w-2xl text-center mx-auto mt-4">
                            Managing a small business today is already tough. Avoid further
                            complications by ditching outdated, tedious trade methods. Our
                            goal is to streamline SMB trade, making it easier and faster than
                            ever.
                        </p>
                    </div>
                    <div className="flex flex-row gap-4 mt-4">
                        <Button size="lg" className="gap-3 rounded-lg border-slate-200 bg-white text-slate-800 hover:bg-slate-50" variant="outline">
                            <span className="font-semibold text-sm">Jump on a call</span> <PhoneCall className="w-4 h-4" />
                        </Button>
                        <Button size="lg" className="gap-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                            <span className="font-semibold text-sm">Sign up here</span> <MoveRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { Hero };
