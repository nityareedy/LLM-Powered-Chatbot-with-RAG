import { HStack } from "@chakra-ui/react";
import { Outlet } from "react-router";

export default function Layout() {
	return (
        <HStack>
            <Outlet/>
        </HStack>
    )
}