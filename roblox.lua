local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local player = Players.LocalPlayer

local SUPER_JUMP_FORCE = 130
local COOLDOWN = 1.5
local canJump = true

local function getCharacterParts()
	local character = player.Character or player.CharacterAdded:Wait()
	local humanoid = character:WaitForChild("Humanoid")
	local rootPart = character:WaitForChild("HumanoidRootPart")

	return character, humanoid, rootPart
end

local function superJump()
	if not canJump then return end
	canJump = false

	local character, humanoid, rootPart = getCharacterParts()

	if humanoid.Health <= 0 then
		canJump = true
		return
	end

	-- Force the character to jump upward
	humanoid:ChangeState(Enum.HumanoidStateType.Jumping)

	rootPart.AssemblyLinearVelocity = Vector3.new(
		rootPart.AssemblyLinearVelocity.X,
		SUPER_JUMP_FORCE,
		rootPart.AssemblyLinearVelocity.Z
	)

	task.wait(COOLDOWN)
	canJump = true
end

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end

	if input.KeyCode == Enum.KeyCode.One then
		superJump()
	end
end)
