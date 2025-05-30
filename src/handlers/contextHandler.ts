import {AIHorde} from "aipg_horde";
import { ApplicationCommandType, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from "discord.js";
import { Pool } from "pg";
import { AIHordeClient } from "../classes/client";
import { ContextContext } from "../classes/contextContext";

export async function handleContexts(interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction, client: AIHordeClient, database: Pool | undefined, ai_horde_manager: AIHorde) {
    const command = await client.contexts.getContext(interaction).catch(() => null)
    if(!command) return;

    let context
    if(interaction.commandType === ApplicationCommandType.User) context = new ContextContext<ApplicationCommandType.User>({interaction, client, database, ai_horde_manager})
    else context = new ContextContext<ApplicationCommandType.Message>({interaction, client, database, ai_horde_manager})

    if(!interaction.inGuild())
        return await context.error({
            error: "You can only use commands in guilds",
            ephemeral: true
        })
    if(!interaction.channel)
        return await context.error({
            error: "Please add me to the private thread (by mentioning me) to use commands",
            ephemeral: true
        })
    if(interaction.appPermissions?.missing(client.getNeededPermissions(interaction.guildId)).length)
        return await context.error({
            error: `I require the following permissions to work:\n${interaction.appPermissions.missing(client.getNeededPermissions(interaction.guildId)).join(", ")}`,
            codeblock: false,
            ephemeral: true
        })

    return await command.run(context).catch(console.error)
}